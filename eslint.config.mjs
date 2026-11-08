import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'next-env.d.ts', 'node_modules/**', 'mobile/**'] },
  ...nextVitals,
  ...nextTypeScript,
];

export default config;
