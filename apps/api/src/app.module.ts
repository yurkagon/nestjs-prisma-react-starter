import { Module } from '@nestjs/common';

import { ConfigModule } from '@/config/config.module';
import { InfraModule } from '@/infra/infra.module';

import { ApiModule } from './api/api.module';

@Module({
  imports: [ConfigModule, InfraModule, ApiModule],
})
export class AppModule {}
