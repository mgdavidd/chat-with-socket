// Importamos los módulos para el servidor http y websocket
import express from 'express';
import { createServer } from "http";
import { Server } from 'socket.io';
// Para usar las variables de entorno
import dotenv from 'dotenv';
// Importamos los esquemas de validación
import { validateSignup } from './schemas/validate.js';
import bcrypt from 'bcryptjs'; // Para hashear la contraseña
// Importamos las rutas
import { ChatRouter } from './routes/chat-routes.js';
import { query } from './config/db.js';
//importamos dependencias de sesion
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser';

dotenv.config();

// Creamos un servidor con express
const app = express();
const server = createServer(app);
// Conectamos al socket.io
const io = new Server(server);

const port = process.env.PORT ?? 3000;
const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY

// Middleware y configuración de estáticos
app.use('/public/img/', express.static('public/img/'));
app.use('/public/css/', express.static('public/css/'));
app.use(express.urlencoded({ extended: true })); // Express ya incluye body-parser
app.set('view engine', 'ejs');

// Configuración de sesión para almacenar el usuario logueado
app.use(express.json())
app.use(cookieParser())
app.use((req, res, next) => {
  const token = req.cookies.access_token;
  if (token) {
    try {
      const data = jwt.verify(token, SECRET_JWT_KEY);
      req.user = data;
    } catch (err) {
      console.error("Token inválido", err);
    }
  }
  next();
});

// Usamos el router del chat
app.use('/', ChatRouter);

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!req.user) {
      
    try {
      // Buscar al usuario por su nombre de usuario
      const result = await query('SELECT * FROM users WHERE username = ?', [username]);

      if (result.length === 0) {
        return res.status(400).render('chek',{ message: 'Login fallido. Usuario no encontrado.' })
      }

      const user = result[0]; // Tomamos el primer registro

      // Compara la contraseña
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).render('chek',{ message: 'Login fallido. Contraseña incorrecta.' })

      }

      const token = jwt.sign({ id: user.id, username: user.username }, SECRET_JWT_KEY, {
        expiresIn: '1h'
      })
      // Redirige al chat
      res
        .cookie('access_token', token, {
        httpOnly: true, // la cookie solo se puede acceder en el servidor
        secure: process.env.NODE_ENV === 'production', // la cookie  solo se puede acceder con https
        sameSite: 'strict', // la cookie que solo sea accesible desde el mismo dominio
        maxAge: 1000 * 60 * 60 // tiempo de vida en segundos osea 1 hora
      })
        .redirect('/Chat');
    } catch (error) {
      console.error('Error durante el login:', error);
      res.status(500).render('chek',{message: 'Error interno en el servidor.' });
    }
  }else{
    res.render('chat', { username: req.user.username })
  }

});

app.post('/signup', async (req, res) => {
  const { username, password, name } = req.body;

  // Valida los datos con el esquema
  const validationResult = validateSignup(req.body);

  if (validationResult.success) {
    try {
      const result = await query('SELECT * FROM users WHERE username = ?', [username]);

      if (result.length > 0) {
        // El usuario ya existe
        return res.render('signup', {
          errors: 'Este usuario ya existe',
          username,
          name
        });
      }

      // Hashea la contraseña antes de guardarla en la base de datos
      const hashedPassword = await bcrypt.hash(password, 10);

      // Inserta el nuevo usuario en la base de datos
      await query('INSERT INTO users (name, username, password) VALUES (?, ?, ?)', [name, username, hashedPassword]);

      const [newUser] = await query('SELECT * FROM users WHERE username = ?', [username]);

      const token = jwt.sign({ id: newUser.id, username: newUser.username }, SECRET_JWT_KEY, {
        expiresIn: '1h'
      })

      // Redirige al usuario al chat
      res
        .cookie('access_token', token, {
        httpOnly: true, // la cookie solo se puede acceder en el servidor
        secure: process.env.NODE_ENV === 'production', // la cookie  solo se puede acceder con https
        sameSite: 'strict', // la cookie que solo sea accesible desde el mismo dominio
        maxAge: 1000 * 60 * 60 // tiempo de vida en segundos osea 1 hora
    })
      .redirect('/Chat');
    } catch (error) {
      console.error('Error al registrar el usuario:', error);
      res.status(500).send('Error interno en el servidor.');
    }
  } else {
    // Si la validación falla, renderiza la vista del signup con los errores
    res.render('signup', {
      errors: validationResult.error.errors, // Pasa los errores al frontend como array
      username,
      name
    });
  }
});

app.get('/Chat', (req, res) => {
  if (!req.user) {
    return res.redirect('/login')
  }
  res.render('chat', { username: req.user.username })
});

app.post('/logout', (req, res) => {
  res
  .clearCookie('access_token')
  .json({ message: 'Logout successful' })
})

// Evento de mensajes en Socket.IO
// Evento de mensajes en Socket.IO
io.on('connection', (socket) => {
  // Obtener el username desde el handshake del cliente
  const username = socket.handshake.auth.username || 'anonymous';
  socket.username = username;

  console.log('Usuario autenticado:', username)

  socket.on('chat message', async (msg) => {
    const username = socket.username;
    const date = new Date()
    const timestamp = Math.floor(Number(date)); // Convierte a número entero
    // Crear el objeto Date
    const fecha = new Date(timestamp);
    const year = fecha.getFullYear()
    const month = fecha.getMonth()
    const day = fecha.getDate()
    const hour = fecha.getHours()
    const minutes = fecha.getMinutes()
    const dateParse = `${day}/${month}/${year} ${hour}:${minutes}`

    try {
      await query('INSERT INTO messages (content, user, date) VALUES (?, ?, ?)', [msg, username, dateParse]);
      io.emit('chat message', msg, username, dateParse);
    } catch (e) {
      console.error(e);
    }
  });

  // Recuperar mensajes antiguos
  socket.on('recover messages', async () => {
    try {
      const results = await query('SELECT id, content, user, date FROM messages ORDER BY id ASC');

      results.forEach(row => {
        socket.emit('chat message', row.content, row.user, row.date)
      });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('disconnect', () => {
    console.log('Un usuario se ha desconectado');
  });
});


// Iniciar el servidor HTTP y WebSocket
server.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
