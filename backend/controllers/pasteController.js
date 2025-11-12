import mongoose from "mongoose";
import Paste from "../models/Paste.js";

export const createPaste = async (req, res) => {
  try {
    const { ciphertext, iv, salt, iterations, meta } = req.body;


    if (!ciphertext || !iv) {
      return res.status(400).json({ error: "Missing ciphertext or iv" });
    }


    let expiresAt = null;
    if (meta?.expiresAt) {
      const expDate = new Date(meta.expiresAt);
      if (!isNaN(expDate.getTime())) {
        expiresAt = expDate.toISOString(); 
      }
    }


    const newPaste = new Paste({
      ciphertext,
      iv,
      salt: salt || null,
      iterations: iterations || null,
      meta: {
        expiresAt,
        burnOnRead: meta?.burnOnRead || false,
      },
    });

    await newPaste.save();




    return res.status(201).json({ id: newPaste._id });
  } catch (error) {
    console.error("Error creating paste:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const getPaste = async (req, res) => {
  try {
    const { id } = req.params;


    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid paste ID" });
    }

    const paste = await Paste.findById(id);

    if (!paste) {
      return res.status(404).json({ error: "Paste not found" });
    }


    if (paste.meta?.expiresAt) {
      const nowUtc = new Date().toISOString();
      const expiresAt = new Date(paste.meta.expiresAt).toISOString();

      if (new Date(expiresAt).getTime() <= new Date(nowUtc).getTime()) {
        await Paste.deleteOne({ _id: id });
        console.log(`⏳ Paste ${id} expired (UTC) and deleted`);
        return res.status(410).json({ error: "Paste expired" });
      }
    }


    res.status(200).json({
      ciphertext: paste.ciphertext,
      iv: paste.iv,
      salt: paste.salt,
      iterations: paste.iterations,
      meta: paste.meta,
    });
  } catch (error) {
    console.error("Error fetching paste:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const burnPaste = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid paste ID" });
    }

    const deleted = await Paste.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Paste not found or already deleted" });
    }


    res.json({ success: true });
  } catch (error) {
    console.error("Error burning paste:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const deletePaste = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid paste ID" });
    }

    const deleted = await Paste.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Paste not found" });
    }


    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting paste:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
