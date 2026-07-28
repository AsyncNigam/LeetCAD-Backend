import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OAuth2Client } from "google-auth-library";
import { User } from "../entities/User.js";

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID") || "mock_google_id";
    this.googleClient = new OAuth2Client(clientId);
  }

  async verifyGoogleToken(token: string): Promise<{ email: string; googleId: string; name: string }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: this.configService.get<string>("GOOGLE_CLIENT_ID") || "mock_google_id",
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new UnauthorizedException("Invalid Google token payload");
      }

      return {
        email: payload.email,
        googleId: payload.sub,
        name: payload.name || payload.email,
      };
    } catch (error) {
      throw new UnauthorizedException("Failed to verify Google token");
    }
  }

  async googleLogin(token: string): Promise<{ accessToken: string }> {
    const { email, googleId, name } = await this.verifyGoogleToken(token);

    let user = await this.userRepository.findOne({ where: { googleId } });

    if (!user) {
      user = this.userRepository.create({ email, googleId, name });
      user = await this.userRepository.save(user);
    } else {
      user.email = email;
      user.name = name;
      user = await this.userRepository.save(user);
    }

    const accessToken = this.jwtService.sign({ userId: user.id });

    return { accessToken };
  }
}
