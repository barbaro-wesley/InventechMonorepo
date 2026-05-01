export type FieldType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'TABLE'
  | 'MULTI_SELECT'
  | 'SINGLE_SELECT'
  | 'CHECKBOX'
  | 'HEADING'
  | 'DIVIDER'
  | 'IMAGE'

export const FIELD_TYPES: FieldType[] = [
  'SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'TABLE',
  'MULTI_SELECT', 'SINGLE_SELECT', 'CHECKBOX', 'HEADING', 'DIVIDER', 'IMAGE',
]

export interface FieldTableColumn {
  key: string
  label: string
  type?: 'text' | 'number'
}

export interface FieldDefinition {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  required?: boolean
  order: number
  width?: 'full' | 'half'
  options?: string[]
  tableColumns?: FieldTableColumn[]
  variable?: string
  value?: unknown
}
