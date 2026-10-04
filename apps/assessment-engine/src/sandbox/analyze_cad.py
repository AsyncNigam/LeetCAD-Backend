import argparse
import json
import sys
import traceback
import os
import base64
from io import BytesIO

import cadquery as cq
import pyvista as pv
import numpy as np
from PIL import Image

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to .step file")
    parser.add_argument("--output", required=True, help="Path to save rendered image")
    args = parser.parse_args()

    try:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        
        # Load the CAD model
        print(f"[sandbox] Input file size: {os.path.getsize(args.input)} bytes", file=sys.stderr)
        shape = cq.importers.importStep(args.input)
        print(f"[sandbox] Shape loaded. Valid: {shape.val() is not None}", file=sys.stderr)
        
        # Calculate metrics
        volume = shape.val().Volume()
        area = shape.val().Area()
        bb = shape.val().BoundingBox()
        center = shape.val().Center()
        
        # Tessellate directly to build PyVista mesh (avoids broken STL/VTP export)
        verts, tris = shape.val().tessellate(0.1)
        print(f"[sandbox] Tessellated: {len(verts)} vertices, {len(tris)} triangles", file=sys.stderr)
        
        if len(verts) == 0 or len(tris) == 0:
            raise ValueError("Tessellation produced empty mesh — geometry may be invalid")
        
        vertices = np.array([(v.x, v.y, v.z) for v in verts], dtype=np.float64)
        faces = np.hstack([[3, t[0], t[1], t[2]] for t in tris]).astype(np.int64)
        mesh = pv.PolyData(vertices, faces)
        
        # 1. Constrain PyVista Resolution & Theme
        plotter = pv.Plotter(off_screen=True, window_size=[800, 600])
        plotter.set_background("#121312")
        plotter.add_mesh(mesh, color="lightblue", smooth_shading=True)
        plotter.reset_camera()
        
        # Capture render as numpy array
        img_array = plotter.screenshot(return_img=True)
        
        # 2. In-Memory JPEG Compression using Pillow (PIL)
        img = Image.fromarray(img_array)
        img = img.convert("RGB")
        
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=80, optimize=True)
        jpeg_bytes = buffer.getvalue()
        
        # Write to disk to preserve compatibility with existing Node.js pipeline
        with open(args.output, "wb") as f:
            f.write(jpeg_bytes)
            
        # 3. Base64 Output
        render_base64 = base64.b64encode(jpeg_bytes).decode("utf-8")

        output = {
            "metrics": {
                "volume": volume,
                "surfaceArea": area,
                "boundingBox": [bb.xmin, bb.ymin, bb.zmin, bb.xmax, bb.ymax, bb.zmax],
                "centerOfMass": [center.x, center.y, center.z],
            },
            "render_base64": render_base64,
            "renders": [args.output],
        }

        print(json.dumps(output))
        sys.exit(0)

    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
