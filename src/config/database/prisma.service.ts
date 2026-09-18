import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import { env } from '../index';
import { Role } from '../../common/enum';
import { Crypt } from '../../infrastructure/lib/Crypt';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: env.DB_URI,
    });
    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');

    const isSuperAdmin = await this.user.findFirst({
      where: {
        role: Role.SUPERADMIN,
      },
    });
    if (!isSuperAdmin) {
      await this.user.create({
        data: {
          fullName: 'Abubakir Botirov',
          email: env.SUPERADMIN.EMAIL,
          hashedPassword: await Crypt.hash(env.SUPERADMIN.PASSWORD),
          role: Role.SUPERADMIN,
        },
      });
      console.log('Super admin created');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
