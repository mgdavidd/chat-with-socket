import { validateSignup } from '../schemas/validate.js';

export const validateSignupInput = (req, res, next) => {
  const { username, password, name } = req.body;

  const validationResult = validateSignup({ username, password, name });

  if (validationResult.success) {
    next(); // Pasa al siguiente middleware o ruta si la validación es correcta
  } else {
    res.status(400).render('signup', { errors: validationResult.error.errors, username, name });
  }
};
