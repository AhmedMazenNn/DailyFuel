import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
export default defineConfig({plugins:[react()],server:{proxy:{'/api':process.env.DAILYFUEL_API_URL || 'http://127.0.0.1:8000','/accounts':process.env.DAILYFUEL_API_URL || 'http://127.0.0.1:8000'}}})
