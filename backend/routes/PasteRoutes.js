import express from "express";
import {
  createPaste,
  getPaste,
  deletePaste,
  burnPaste,
} from "../controllers/pasteController.js";

const router = express.Router();

router.post("/", createPaste);
router.get("/:id", getPaste);
router.delete("/:id", deletePaste);
router.delete("/:id/burn", burnPaste); 

export default router;
