# Startup Dev
我想你讀過我留的在桌面上 `IMPROTANT.txt` 🙂
### 想要開發的話 Fork 自己的分支 🔶

```bash
# Install dependency
npm install

# Run development with hot reload
npm run dev
```

當時用 [tailscale](https://tailscale.com/) 作為VPN連接 `school-server` 是我給伺服器的 `Domain Name`
### Environmental variables ([Example](.env.example))
- `OLLAMA_HOST_URL`=http://school-server:11434
- `OLLAMA_MODEL`=gemma3
- `DB_IP`=school-server
- `DB_PW`=pw
- `DB_PORT`=5442
- `PORT`=3000
- `DB_DATABASE`=School_DEV
- `QUERY_POSTFIX`=_DEV
