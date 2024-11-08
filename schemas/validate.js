import z from 'zod'

const signupSchema = z.object({
    username: z.string()
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
        .max(20, 'El nombre de usuario no puede exceder los 20 caracteres')
        .refine((username) => username.trim().length >= 3, 'El nombre de usuario debe tener al menos 3 caracteres sin contar espacios en blanco')
        .refine((username) => username.trim().length > 0, 'El nombre de usuario no puede estar en blanco'),
    password: z.string()
        .min(6, 'La contraseña debe tener al menos 6 caracteres')
        .max(15, 'La contraseña no puede exceder los 15 caracteres')
        .refine((password) => !/\s/.test(password), 'La contraseña no puede contener espacios')
        .refine((password) => /[A-Za-z]/.test(password), 'La contraseña debe contener al menos una letra')
        .refine((password) => /\d/.test(password), 'La contraseña debe contener al menos un número'),
    name: z.string()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(50, 'El nombre no puede exceder los 50 caracteres')
        .refine((name) => name.trim().length >= 2, 'El nombre debe tener al menos 2 caracteres sin contar espacios en blanco')
        .refine((name) => name.trim().length > 0, 'El nombre no puede estar en blanco') // Asegura que no sea solo espacios
        .refine((name) => !/\s{2,}/.test(name), 'El nombre no puede tener más de un espacio consecutivo')
})

export function validateSignup (input) {
    return signupSchema.safeParse(input)
}