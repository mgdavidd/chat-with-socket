// Importamos los módulos para el servidor http y websocket
import express from 'express';
import { createServer } from "http";
import { Server } from 'socket.io';
// Para usar las variables de entorno
import dotenv from 'dotenv';
// Importamos los esquemas de validación
import { validateSignup } from './schemas/validate.js';
import bcrypt from 'bcryptjs'; // Para hashear la contraseña
//DB
import { query } from './config/db.js';
//importamos dependencias de sesion
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser';
// CORS
import cors from 'cors';


dotenv.config();

// Creamos un servidor con express
const app = express();
const server = createServer(app);
// Conectamos al socket.io
const io = new Server(server);

const port = process.env.PORT ?? 3000;
const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY

const corsOptions = {
  origin: 'https://chat-with-socket-1-s0rl.onrender.com', // URL permitida
  methods: ['GET', 'POST'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Encabezados permitidos
  credentials: true, // Permitir cookies en las solicitudes CORS
};
app.use(cors(corsOptions));

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
  if (!token) {
    req.user = null
    return next()
  }

  try {
    const data = jwt.verify(token, SECRET_JWT_KEY)
    req.user = data
    next();
  } catch (err) {
    console.error("Token inválido:", err.message)
    res.clearCookie('access_token')
    req.user = null;
    next();
  }
});


app.get('/', (req, res) => {
  if (!req.user) {
    res.render('login');
  }else{
    res.redirect('chats')
  }
});

app.get('/signup', (req, res) => {

  if (!req.user) {
    res.render('signup', {
      errors: 0,
      username: '',
      name: ''
    });
  }else{
    res.redirect('chats')

  }
});
app.get('/chats', async (req, res) => {
  if (!req.user) {
    return res.redirect('/')
  }

  try {
    const result = await query('SELECT id FROM users WHERE username = ?', [req.user.username]);

    if (result.length > 0) {
      const userId = result[0].id;
      const chats = await query(`
        SELECT chats.chat_name
        FROM chats
        JOIN users_chats ON chats.id = users_chats.chat_id
        WHERE users_chats.user_id = ?
      `, [userId]);
      const ids = await query(`
        SELECT chats.id
        FROM chats
        JOIN users_chats ON chats.id = users_chats.chat_id
        WHERE users_chats.user_id = ?
      `, [userId]);
      console.log(ids)
      const userChat = await query(`
        SELECT chats.chat_name
        FROM chats
        JOIN users_chats ON chats.id = users_chats.chat_id
        WHERE users_chats.user_id = ? AND chats.created_by = ?
      `, [userId, userId]);
      const userChatId = await query(`
        SELECT chats.id
        FROM chats
        JOIN users_chats ON chats.id = users_chats.chat_id
        WHERE users_chats.user_id = ? AND chats.created_by = ?
      `, [userId, userId]);

      res.render('chats', { chats, userChat, username : req.user.username, ids, userChatId });
    } else {
      res.render('chats', { chats: [], userChat: [], username : req.user.username, ids, userChatId });
    }
  } catch (error) {
    console.error('Error al obtener los chats:', error);
    res.status(500).send('Error al obtener los chats.');
  }
});

app.get('/chat/:chatId', async (req, res) => {
  //verifico el token del usuario
  if (!req.user) {
    return res.redirect('/');
  }

  const { chatId } = req.params;

  try {
    //tomo la informacion correspondiente al chat
    const [chat] = await query('SELECT * FROM chats WHERE id = ?', [chatId]);
    if (!chat) {
      return res.status(404).render('chek', { message: "Chat no encontrado." });

    }
    //verifico si el usuario tiene acceso a su respectivo chat
    const [access] = await query(
      'SELECT * FROM users_chats WHERE user_id = ? AND chat_id = ?',
      [req.user.id, chatId]
    );
    //si no tiene acceso
    if (!access) {
      return res.status(403).render('chek', { message: "No tienes acceso a este chat" });
    }
    //si tiene acceso, tomo todos los mensages del chat en orden
    const messages = await query(
      'SELECT m.content, u.username, m.sent_at FROM messages m JOIN users u ON m.user_id = u.id WHERE m.chat_id = ? ORDER BY m.sent_at ASC',
      [chatId]
    );
    //y se los paso a la vista chat junto a el resto de la informacion
    res.render('chat', {
      chat: chat.chat_name,
      messages,
      username: req.user.username,
      id: chatId,
      token: req.cookies.access_token
    });
  } catch (error) {
    console.error("Error al cargar el chat:", error.message);
    res.status(500).send("Error interno del servidor.");
  }
});



app.post('/leave-chat', async (req, res) => {
  const {chatId} = req.body
  try {
    const userId = await query('SELECT id FROM users WHERE username = ?',[req.user.username])
    await query('DELETE FROM users_chats WHERE chat_id = ? AND user_id = ?',[chatId, userId[0].id])
    res.json({ message: 'Has salido del chat correctamente.' });
  } catch (error) {
    console.error('Error al salir del chat:', error);
    res.render('chek', {message: 'error al salir del chat'})
  }

})

app.post('/delete-chat/:id', async (req, res) => {
  const chatId = req.params.id;
  const { password } = req.body;

  try {
    let result = await query('SELECT * FROM chats WHERE id = ? AND chat_password = ?', [chatId, password]);

    if (!result || result.length === 0) {
      return res.status(400).render('chek', { message: 'Chat no encontrado o la contraseña es incorrecta' });
    }
    await query('DELETE FROM users_chats WHERE chat_id = ?', [chatId]);

    await query('DELETE FROM chats WHERE id = ? AND chat_password = ?', [chatId, password]);

    res.redirect('/chats');
  } catch (error) {
    console.error(error);
    res.status(400).render('chek', { message: '¡Ha ocurrido un error!' });
  }
});


app.get('/create-chat',(req, res) => {
  if (!req.user) {
    return res.redirect('/')
  }
  res.render('create-chat')
})

app.get('/join-the-chat',(req, res) => {
  if (!req.user) {
    return res.redirect('/')
  }
  res.render('join-the-chat')
})

app.post('/logout', (req, res) => {
  res
  .clearCookie('access_token')
  .json({ message: 'Logout successful' })
})


app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!req.user) {
      
    try {
      // Buscar al usuario por su nombre de usuario
      const result = await query('SELECT * FROM users WHERE username = ?', [username]);

      if (result.length === 0) {
        return res.status(400).render('chek',{ message: 'Login fallido. Usuario no encontrado.' })
      }

      const user = result[0];

      // Compara la contraseña
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).render('chek',{ message: 'Login fallido. Contraseña incorrecta.' })

      }

      const token = jwt.sign({ id: user.id, username: user.username }, SECRET_JWT_KEY, {
        expiresIn: '3h'
      })
      // Redirige a los chats
      res
        .cookie('access_token', token, {
        httpOnly: true, // la cookie solo se puede acceder en el servidor
        secure: process.env.NODE_ENV === 'production', // la cookie  solo se puede acceder con https
        sameSite: 'strict', // la cookie que solo sea accesible desde el mismo dominio
        maxAge: 1000 * 60 * 60 // tiempo de vida en segundos osea 1 hora
      })
        .redirect('/chats');
    } catch (error) {
      console.error('Error durante el login:', error);
      res.status(500).render('chek',{message: 'Error interno en el servidor.' });
    }
  }else{
    res.render('chats', { username: req.user.username })
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
      .redirect('/chats');
    } catch (error) {
      console.error('Error al registrar el usuario:', error);
      res.status(500).send('Error interno en el servidor.');
    }
  } else {
    // Si la validación falla, renderiza la vista del signup con los errores
    res.render('signup', {
      errors: validationResult.error.errors,
      username,
      name
    })
  }
});

app.post('/create-chat', async (req, res) => {
  const { chatName, chatPassword } = req.body;
  const userId = await query('SELECT id FROM users WHERE username = ?',[req.user.username])

  try {
    const insert = await query(
      'INSERT INTO chats (chat_name, created_by, chat_password) VALUES (?, ?, ?)',
      [chatName, userId[0].id, chatPassword]
    );
    const [result] = await query('SELECT id FROM chats WHERE chat_name = ? AND created_by = ? ORDER BY created_at DESC LIMIT 1', [chatName, userId[0].id]);
    const chatId = result.id;
    await query('INSERT INTO users_chats (chat_id, user_id) VALUES (?, ?)', [chatId, userId[0].id])

    res.redirect(`/chat/${chatId}`);
  } catch (error) {
    if(error.code == 'SQLITE_CONSTRAINT'){
      return res.status(409).render('chek',{ message: `El chat '${chatName}' ya ha sido creado` })
    }else{
      return res.status(409).render('chek',{ message: `Error al crear el chat` })

    }
  }
});

app.post('/join-the-chat', async (req, res) => {
  const { chatName, chatPassword, chatId } = req.body;

  try {    
    const [userId] = await query('SELECT id FROM users WHERE username = ?', [req.user.username]);

    if (userId.length === 0 || !userId) {
      return res.status(500).render('chek', {message: `Usuario no encontrado`})
    }
    
    const [chat] = await query('SELECT id FROM chats WHERE chat_name = ? AND chat_password = ? AND id = ?',
      [chatName, chatPassword, chatId]);

    if (!chat) {
      return res.status(500).render('chek', {message: `'Chat no encontrado o información incorrecta'`})
    }
    const result = await query('SELECT * FROM users_chats WHERE chat_id = ? AND user_id = ?', [chat.id, userId.id]);
    console.log(result)
    
    if(result.length > 0){      
      return res.status(500).render('chek', {message: `Ya estas dentro del chat '${chatName}' no puedes volver a unirte`})
    }else{
      await query('INSERT INTO users_chats (chat_id, user_id) VALUES (?, ?)', [chat.id, userId.id]);
      res.redirect(`/chat/${chat.id}`)
    }
  } catch (error) {
    console.log(error)
    res.status(500).render('chek', {message: `Hubo un error`})
  }
});

io.use(async (socket, next) => {
  //tomo las variables de authentication
  const token = socket.handshake.auth.token;
  const chatId = socket.handshake.auth.chatId;
  //verifico si existen
  if (!token || !chatId) {
    return next(new Error('Token o chatId no proporcionado.'));
  }

  try {
    // verifico si es valido el token
    const decoded = jwt.verify(token, process.env.SECRET_JWT_KEY);
    const userId = decoded.id;

    const [access] = await query(
      'SELECT * FROM users_chats WHERE user_id = ? AND chat_id = ?',
      [userId, chatId]
    );

    if (!access) {
      return next.render('chek', {message: 'Acceso denegado'})

    }

    // Almacenar IDs y datos útiles en el socket
    socket.userId = userId;
    socket.chatId = chatId;
    socket.username = decoded.username;

    // Unir al usuario a la sala específica del chat
    socket.join(`chat_${chatId}`);
    next();
  } catch (e) {
    next(new Error('Token inválido o acceso denegado.'));
  }
});

// Evento de conexión
io.on('connection', async (socket) => {
  console.log(`Usuario ${socket.username} conectado al chat ${socket.chatId}`)

  try {
    // Recuperar mensajes del chat actual
    const messages = await query(`
      SELECT m.content, u.username AS user, m.sent_at AS date
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.chat_id = ?
      ORDER BY m.id ASC
    `, [socket.chatId]);

    // Enviar mensajes cargados al cliente
    socket.emit('load messages', messages);

    // Escuchar y manejar nuevos mensajes enviados
    socket.on('chat message', async (msg) => {
      const date = new Date();
      try {
        await query(
          'INSERT INTO messages (user_id, chat_id, content, sent_at) VALUES (?, ?, ?, ?)',
          [socket.userId, socket.chatId, msg, date]
        );

        // Emitir el nuevo mensaje a todos los usuarios en la sala
        io.to(`chat_${socket.chatId}`).emit('chat message', msg, socket.username, date, socket.chatId);
      } catch (error) {
        console.error("Error al guardar el mensaje:", error);
      }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
      console.log(`Usuario ${socket.username} desconectado del chat ${socket.chatId}`);
    });
  } catch (error) {
    console.error("Error en la conexión del socket:", error.message);
    socket.disconnect()
  }
});


// Iniciar el servidor HTTP y WebSocket
server.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
