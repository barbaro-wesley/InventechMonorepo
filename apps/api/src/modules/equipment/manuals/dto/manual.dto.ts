import {
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUrl,
    ValidateIf,
} from 'class-validator'
import { ManualType } from '@prisma/client'

export class CreateManualDto {
    @IsString()
    titulo: string

    @IsOptional()
    @IsString()
    descricao?: string

    @IsEnum(ManualType)
    tipo: ManualType

    @ValidateIf((o) => o.tipo === ManualType.TEXTO)
    @IsString()
    conteudoTexto?: string

    @ValidateIf((o) => o.tipo === ManualType.LINK)
    @IsUrl()
    url?: string

    @IsOptional()
    @IsBoolean()
    ativo?: boolean
}

export class UpdateManualDto {
    @IsOptional()
    @IsString()
    titulo?: string

    @IsOptional()
    @IsString()
    descricao?: string

    @IsOptional()
    @IsString()
    conteudoTexto?: string

    @IsOptional()
    @IsUrl()
    url?: string

    @IsOptional()
    @IsBoolean()
    ativo?: boolean
}
