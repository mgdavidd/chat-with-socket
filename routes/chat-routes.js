import { Router } from "express"

export const ChatRouter = Router()

ChatRouter.get('/login', (req, res) => {
  if (!req.user) {
    res.render('login');
  }else{
    res.redirect('chat')
  }
});

ChatRouter.get('/signup', (req, res) => {
    // Ponemos estos campos vacíos por defecto
  if (!req.user) {
    res.render('signup', {
      errors: 0,
      username: '',
      name: ''
    });
  }else{
    res.redirect('chat')

  }
});
