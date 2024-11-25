// routes/sheetRoutes.js

const express = require("express");
const { body, param } = require("express-validator");
const sheetController = require("../controllers/sheetController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sheets
 *   description: Sheet management within spreadsheets
 */

/**
 * @swagger
 * /spreadsheets/{id}/sheets:
 *   post:
 *     summary: Create a new sheet in a spreadsheet
 *     tags: [Sheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Spreadsheet ID
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "New Sheet"
 *     responses:
 *       '201':
 *         description: Sheet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sheet:
 *                   $ref: '#/components/schemas/Sheet'
 *       '400':
 *         description: Bad request, invalid input
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet not found
 */
router.post(
  "/:id/sheets",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    body("name").isLength({ min: 1 }).withMessage("Sheet name is required"),
    validateRequest,
  ],
  sheetController.createSheet
);

/**
 * @swagger
 * /spreadsheets/{id}/sheets:
 *   get:
 *     summary: Get all sheets in a spreadsheet
 *     tags: [Sheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Spreadsheet ID
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       '200':
 *         description: List of sheets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sheets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sheet'
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet not found
 */
router.get(
  "/:id/sheets",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    validateRequest,
  ],
  sheetController.getSheets
);

/**
 * @swagger
 * /spreadsheets/{id}/sheets/{sheetId}:
 *   get:
 *     summary: Get a specific sheet by ID
 *     tags: [Sheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Spreadsheet ID
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: sheetId
 *         required: true
 *         description: Sheet ID
 *         schema:
 *           type: string
 *           example: "660e8400-e29b-41d4-a716-446655440111"
 *     responses:
 *       '200':
 *         description: Sheet details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sheet:
 *                   $ref: '#/components/schemas/Sheet'
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Sheet not found
 */
router.get(
  "/:id/sheets/:sheetId",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    validateRequest,
  ],
  sheetController.getSheetById
);

/**
 * @swagger
 * /spreadsheets/{id}/sheets/{sheetId}:
 *   put:
 *     summary: Update a sheet by ID
 *     tags: [Sheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Spreadsheet ID
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: sheetId
 *         required: true
 *         description: Sheet ID
 *         schema:
 *           type: string
 *           example: "660e8400-e29b-41d4-a716-446655440111"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Sheet Name"
 *     responses:
 *       '200':
 *         description: Sheet updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sheet:
 *                   $ref: '#/components/schemas/Sheet'
 *       '400':
 *         description: Bad request, invalid input
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Sheet not found
 */
router.put(
  "/:id/sheets/:sheetId",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    body("name").isLength({ min: 1 }).withMessage("Sheet name is required"),
    validateRequest,
  ],
  sheetController.updateSheet
);

/**
 * @swagger
 * /spreadsheets/{id}/sheets/{sheetId}:
 *   delete:
 *     summary: Delete a sheet by ID
 *     tags: [Sheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Spreadsheet ID
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: sheetId
 *         required: true
 *         description: Sheet ID
 *         schema:
 *           type: string
 *           example: "660e8400-e29b-41d4-a716-446655440111"
 *     responses:
 *       '200':
 *         description: Sheet deleted successfully
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Sheet not found
 */
router.delete(
  "/:id/sheets/:sheetId",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    validateRequest,
  ],
  sheetController.deleteSheet
);

module.exports = router;
