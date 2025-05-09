import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend-backend communication
  app.enableCors();

  await app.listen(3000);
  console.log('Backend is running on http://localhost:3000');
}
bootstrap();