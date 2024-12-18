import { createClient } from '@libsql/client'; // Importa el cliente de Turso
import dotenv from 'dotenv'; // Para cargar las variables de entorno

// Carga las variables de entorno desde el archivo .env
dotenv.config();

// Crea el cliente de la base de datos de Turso usando las variables de entorno
const db = createClient({
  url: process.env.TURSO_DB_URL,  // URL de la base de datos
  authToken: process.env.TURSO_DB_TOKEN // Token de autenticación
});

// Función para crear las tablas si no existen
async function setupDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          username TEXT,
          password TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_name TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        chat_password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT unique_chat_name_per_user UNIQUE (chat_name, created_by)
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users_chats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          chat_id INTEGER NOT NULL,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (user_id, chat_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          chat_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);

    console.log('Tablas creadas/existen correctamente');
  } catch (error) {
    console.error('Error al crear las tablas:', error);
  }
}

// Función para ejecutar consultas SQL
export const query = async (sql, params = []) => {
  try {
    const result = await db.execute(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error ejecutando la consulta:', error);
    throw error;
  }
};

// Llamamos a la función para asegurarnos de que las tablas estén configuradas
setupDatabase().catch((err) => console.error(err));

// Exporta el cliente de la base de datos para usarlo en otros módulos
export { db };
