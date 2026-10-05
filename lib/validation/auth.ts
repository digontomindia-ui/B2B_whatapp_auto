import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required")
});

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
