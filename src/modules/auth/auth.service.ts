import {
  NotFoundException,
  BadRequestException,
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { SignInDto } from './dto/sign-in.dto';
import { Crypt } from '../../infrastructure/lib/Crypt';
import { successRes } from '../../common/helper/success-response';
import { EmailOtpService } from '../mail/mail-otp.service';
import { VerifyOTPDto } from '../mail/dto/verify-mail-otp.dto';
import { Token } from '../../infrastructure/lib/Token';
import type { Response, Request } from 'express';
import { getDeviceInfo } from '../../common/helper/device-info';
import { env } from '../../config';
import { SignUpDto } from './dto/sign-up.dto';
import { Role } from '../../common/enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly otp: EmailOtpService,
  ) {}

  async signUp(createAdminDto: SignUpDto) {
      const { email, password } = createAdminDto;
      const existsEmail = await this.db.user.findUnique({ where: { email } });
      if (existsEmail) {
        throw new ConflictException('Bunday email tizimda allaqachon mavjud');
      }
      const hashedPassword = await Crypt.hash(password);
      const user = await this.db.user.create({
        data: { email, hashedPassword, role: Role.CUSTOMER },
      });
      return successRes(user, 201);
    }

  async signIn(dto: SignInDto) {
    const user: any = await this.db.user.findUnique({
      where: { email: dto.email },
    });
    const isMatchPass = await Crypt.compare(
      dto.password,
      user ? user.hashedPassword : '',
    );
    if (!isMatchPass) {
      throw new BadRequestException('Email yoki parol xato');
    }
    const data = await this.otp.sendOtp(user.email);
    return successRes(data, 201);
  }

  async confirmSignIn(dto: VerifyOTPDto, req: Request, res: Response) {
    const user = await this.db.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    await this.otp.verifyOtp(user.email, dto.code);
    
    const { client, os } = getDeviceInfo(req);
    const device = await this.db.devices.create({
      data: {
        user: { connect: { id: user.id } },
        device: `${client?.name} ${os?.name ? os.name : 'unknown'}`,
        hashedRefreshToken: '',
        expiresAt: env.TOKEN.REFRESH_TIME,
      },
    });
    const payload = {
      sub: user.id,
      role: user.role,
      status: user.status,
      deviceId: device.deviceId,
    };
    const { accessToken, refreshToken } = await Token.getToken(payload);
    const hashedRefreshToken = await Crypt.hash(refreshToken);
    await this.db.devices.update({
      where: { deviceId: device.deviceId },
      data: {
        hashedRefreshToken,
      },
    });
    Token.setCookie(res, accessToken, refreshToken);
    return successRes(
      {
        userId: device.userId,
        deviceId: device.deviceId,
        device: device.device,
        createdAt: device.createdAt,
      },
      201,
    );
  }

  async refreshToken(refreshToken: string, res: Response) {
    const verifiedData = await Token.verifyToken(refreshToken, 'refresh');
    const device = await this.db.devices.findUnique({
      where: {
        deviceId: verifiedData.deviceId,
        userId: verifiedData.userId,
      },
    });
    if (!device) {
      throw new BadRequestException(
        'Tizimda bunday foydalanuvchi yoki qurilma topilmadi',
      );
    }
    const isMatchToken = await Crypt.compare(
      refreshToken,
      device.hashedRefreshToken,
    );
    if (!isMatchToken) {
      throw new BadRequestException("Qurilma tizimda ro'yxatdan o'tmagan");
    }
    delete verifiedData.iat;
    delete verifiedData.exp;
    const { accessToken } = await Token.getToken(verifiedData);
    Token.setCookie(res, accessToken);
    return successRes(
      {
        userId: device.userId,
        deviceId: device.deviceId,
        device: device.device,
        createdAt: device.createdAt,
      },
      201,
    );
  }

  async signOut(refreshToken: string, res: Response) {
    const verifiedData = await Token.verifyToken(refreshToken, 'refresh');
    await this.db.devices.delete({
      where: {
        deviceId: verifiedData.deviceId,
        userId: verifiedData.userId,
      },
    });
    Token.clearCookie(res);
    return successRes({});
  }
}
