import jwt from 'jsonwebtoken'

export async function login(req, res) {
  const { usuario, senha } = req.body ?? {}

  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' })
  }

  const validUser  = process.env.LOGIN_USER
  const validSenha = process.env.LOGIN_SENHA
  const secret     = process.env.JWT_SECRET

  if (!validUser || !validSenha || !secret) {
    return res.status(500).json({ error: 'Servidor não configurado corretamente' })
  }

  if (usuario !== validUser || senha !== validSenha) {
    // Delay fixo pra dificultar timing attacks em brute-force
    await new Promise(r => setTimeout(r, 400))
    return res.status(401).json({ error: 'Usuário ou senha incorretos' })
  }

  const token = jwt.sign({ usuario }, secret, { expiresIn: '12h' })
  res.json({ token })
}
