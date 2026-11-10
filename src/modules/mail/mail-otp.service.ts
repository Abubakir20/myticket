import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac, randomInt } from 'crypto';
import { RedisService } from '../../config/redis/redis.service';
import { env } from '../../config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly mailerService: MailerService,
  ) {}

  private normalizeEmail(value: string): string {
    const email = value.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email manzili noto‘g‘ri');
    }
    return email;
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashOtp(email: string, code: string): string {
    return createHmac('sha256', env.OTP.SECRET)
      .update(`${email}:${code}`)
      .digest('hex');
  }

  private otpKey(email: string) {
    return `email-otp:value:${email}`;
  }

  private attemptsKey(email: string) {
    return `email-otp:attempts:${email}`;
  }

  async sendOtp(emailInput: string) {
    const redis = this.redisService.client;

    const email = this.normalizeEmail(emailInput);

    const otpKey = this.otpKey(email);
    const attemptsKey = this.attemptsKey(email);

    const code = this.generateOtp();
    const otpHash = this.hashOtp(email, code);

    await redis
      .multi()
      .set(otpKey, otpHash, 'EX', env.OTP.TTL)
      .set(attemptsKey, '0', 'EX', env.OTP.TTL)
      .exec();

    // Kod tasdiqlash sahifasida ko'rsatiladi (javobdagi `code`). Email fonda yuborishga
    // urinib ko'riladi — SMTP yopiq bo'lsa ham jarayon to'xtamaydi, xato faqat logga yoziladi.
    this.mailerService
      .sendMail({
        to: email,
        subject: 'Myticket - Tasdiqlash kodi',
        text: `Sizning tasdiqlash kodingiz: ${code}
    Kod ${env.OTP.TTL} sekund davomida amal qiladi.`,
      })
      .catch((error: Error) =>
        this.logger.warn(`OTP email yuborilmadi (${email}): ${error.message}`),
      );

    return {
      success: true,
      message: 'Tasdiqlash kodi yaratildi',
      expiresIn: env.OTP.TTL,
      resendAfter: env.OTP.RESEND,
      code,
    };
  }

  async verifyOtp(emailInput: string, code: string) {
    const redis = this.redisService.client;

    const email = this.normalizeEmail(emailInput);

    const otpKey = this.otpKey(email);
    const attemptsKey = this.attemptsKey(email);

    const candidateHash = this.hashOtp(email, code);

    const script = `
      local stored = redis.call('GET', KEYS[1])

      if not stored then
        return -2
      end

      local attempts =
        tonumber(redis.call('GET', KEYS[2]) or '0')

      local maxAttempts =
        tonumber(ARGV[2])

      if attempts >= maxAttempts then
        redis.call('DEL', KEYS[1], KEYS[2])
        return -1
      end

      if stored == ARGV[1] then
        redis.call('DEL', KEYS[1], KEYS[2])
        return 1
      end

      attempts =
        redis.call('INCR', KEYS[2])

      local otpTtl =
        redis.call('TTL', KEYS[1])

      if otpTtl > 0 then
        redis.call(
          'EXPIRE',
          KEYS[2],
          otpTtl
        )
      end

      if attempts >= maxAttempts then
        redis.call('DEL', KEYS[1], KEYS[2])
        return -1
      end

      return 0
    `;

    const result = Number(
      await redis.eval(
        script,
        2,
        otpKey,
        attemptsKey,
        candidateHash,
        String(env.OTP.ATTEMPTS),
      ),
    );

    if (result === -2) {
      throw new BadRequestException(
        'OTP kodi mavjud emas yoki muddati tugagan',
      );
    }

    if (result === -1) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'OTP kiritish urinishlari soni tugadi. Yangi kod so‘rang.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (result === 0) {
      throw new BadRequestException('OTP kodi noto‘g‘ri');
    }

    return {
      success: true,
      verified: true,
      email,
    };
  }
}
