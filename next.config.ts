import type {NextConfig} from 'next';
const nextConfig:NextConfig={outputFileTracingIncludes:{'/*':['./migrations/*.sql']}};
export default nextConfig;
