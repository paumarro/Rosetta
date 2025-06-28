import express, { Request, Response } from "express";
import morgan from 'morgan'

const app = express()
const PORT = process.env.PORT || 3001

app.use(morgan("combined")) // use "dev" for development and "combined" for production
app.get("/", (req: Request, res: Response) => {
  console.log("Requested: ", req.url)
  res.sendStatus(200)
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
export default app