import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filter/all-exeption.filter';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  UPLOADS_PREFIX,
  UPLOADS_ROOT,
} from './config/upload/event-image.upload';
export class App {
  static async main() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    // Tadbir rasmlari statik tarzda /uploads orqali beriladi (TZ 5-bo'lim)
    app.useStaticAssets(UPLOADS_ROOT, { prefix: UPLOADS_PREFIX });
    const port = env.PORT;
    const url = 'api/v1';

    app.use(cookieParser());

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());

    // cross-origin: frontend boshqa domendan rasmlarni ochishi uchun
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

    app.enableCors({ origin: '*' });

    app.setGlobalPrefix(url);
    const config = new DocumentBuilder()
      .setTitle('DAAS myticket demo project')
      .setVersion('1.0')
      .build();
    
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${url}/docs`, app, documentFactory);

    app.listen(port, () => console.log('Server is running on port', port));
  }
}
