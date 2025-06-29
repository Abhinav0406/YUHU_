import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import iceRoutes from './routes/ice';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend-backend communication
  app.enableCors();

  // Register ICE routes
  app.use('/api', iceRoutes);

  await app.listen(3000);
  console.log('Backend is running on http://localhost:3000');
}
bootstrap();