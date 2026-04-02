import { Module } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsRepository } from './organizations.repository'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService, OrganizationsRepository],
})
export class OrganizationsModule {}