import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([...nextVitals,...nextTs,globalIgnores(['.next/**']),{files:['verification/**/*.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'}},{rules:{'react-hooks/set-state-in-effect':'off'}}]);
