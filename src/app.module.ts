import { Module } from '@nestjs/common';
import { App } from './app.service';
import { PrismaModule } from './config/database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [],
})
export class AppModule {}
