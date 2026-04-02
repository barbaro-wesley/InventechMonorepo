import { Module } from '@nestjs/common'
import { TenantsService } from './tenants.service'
import { TenantsController } from './tenants.controller'
import { TenantsRepository } from './tenants.repository'
import { LicenseService } from './license.service'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [StorageModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, LicenseService],
  exports: [TenantsService, TenantsRepository, LicenseService],
})
export class TenantsModule {}