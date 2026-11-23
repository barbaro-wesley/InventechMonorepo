import type { Request } from 'express'

/** IP real do cliente, considerando proxies (x-forwarded-for / x-real-ip). */
export function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) {
        const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
        return first.trim()
    }
    return (req.headers['x-real-ip'] as string) || req.ip || ''
}
