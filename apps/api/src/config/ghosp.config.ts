import { registerAs } from '@nestjs/config'

export default registerAs('ghosp', () => ({
  host: process.env.POSTGRES_GHOSP_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_GHOSP_PORT ?? '5432', 10),
  database: process.env.POSTGRES_GHOSP_DB,
  user: process.env.POSTGRES_GHOSP_USER,
  password: process.env.POSTGRES_GHOSP_PASSWORD,
}))
