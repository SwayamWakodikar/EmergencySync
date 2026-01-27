import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
const app= express();
const port=process.env.PORT;
app.use(cors());
app.use(express.json())
app.get("/",(req,res)=>{
    console.log("got poked")
}
)

app.listen(port,()=>{
    console.log(`Server Running at port ${port}`);
})