import argparse
import json
import sys
import traceback
import os

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to .step file")
    parser.add_argument("--output", required=True, help="Path to save rendered .png")
    args = parser.parse_args()

    try:
        import cadquery as cq

        result = cq.importers.importStep(args.input)
        shape = result.val()

        volume = float(shape.Volume())
        surface_area = float(shape.Area())
        center = shape.Center()
        center_of_mass = [float(center.x), float(center.y), float(center.z)]

        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

        render_with_pyvista(result, args.output)

        output = {
            "metrics": {
                "volume": volume,
                "surfaceArea": surface_area,
                "centerOfMass": center_of_mass,
            },
            "renders": [args.output],
        }

        print(json.dumps(output))
        sys.exit(0)

    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


def render_with_pyvista(result: "cq.Workplane", output_path: str) -> None:
    import pyvista as pv
    from cadquery import exporters

    stl_path = output_path.replace(".png", ".stl")

    try:
        exporters.export(result, stl_path, exporters.ExportTypes.STL)

        pv.OFF_SCREEN = True
        plotter = pv.Plotter(off_screen=True, window_size=[1920, 1080])

        mesh = pv.read(stl_path)
        plotter.add_mesh(
            mesh,
            color="#b0b0b0",
            specular=0.5,
            specular_power=20,
            smooth_shading=True,
        )
        plotter.set_background("#1e1e2e")
        plotter.add_light(pv.Light(position=(10, 10, 10), intensity=0.8))
        plotter.camera.azimuth = 45
        plotter.camera.elevation = 30
        plotter.reset_camera()

        plotter.screenshot(output_path)
        plotter.close()
    finally:
        if os.path.exists(stl_path):
            os.remove(stl_path)


if __name__ == "__main__":
    main()
