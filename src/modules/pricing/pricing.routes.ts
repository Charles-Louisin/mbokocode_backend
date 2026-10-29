import { Router } from "express";
import { assertDatabaseReady } from "../../db/connection.js";
import { PricingPackage } from "./pricing.model.js";
import { Service } from "./service.model.js";

export const servicesRouter = Router();
export const pricingRouter = Router();

servicesRouter.get("/", async (_req, res) => {
  assertDatabaseReady();
  const services = await Service.find({ isPublished: true }).select("-isPublished").sort({ sortOrder: 1 });
  res.json({ data: services.map((service) => service.toJSON()) });
});

pricingRouter.get("/", async (_req, res) => {
  assertDatabaseReady();
  const packages = await PricingPackage.find({ isPublished: true }).select("-isPublished").sort({ sortOrder: 1 });
  res.json({ data: packages.map((item) => item.toJSON()) });
});
