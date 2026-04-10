import mjml2html from 'mjml'

export function compileMjml(mjmlTemplate: string): string {
    const { html, errors } = mjml2html(mjmlTemplate, { validationLevel: 'soft' })

    if (errors.length > 0) {
        const messages = errors.map((e) => e.formattedMessage).join('\n')
        throw new Error(`MJML compilation errors:\n${messages}`)
    }

    return html
}
