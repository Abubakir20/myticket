import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filter/all-exeption.filter';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
export class App {
  static async main() {
    const app = await NestFactory.create(AppModule);
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

    app.use(helmet());

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
