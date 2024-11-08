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
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        user TEXT,
        date TEXT
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
    // Si hay parámetros, pasa el SQL y los parámetros a `db.execute`
    const result = await db.execute(sql, params);
    return result.rows; // Devuelve las filas de los resultados de la consulta
  } catch (error) {
    console.error('Error ejecutando la consulta:', error);
    throw error;
  }
};

// Llamamos a la función para asegurarnos de que las tablas estén configuradas
setupDatabase().catch((err) => console.error(err));

// Exporta el cliente de la base de datos para usarlo en otros módulos
export { db };
