// routes/sheetRoutes.js

const express = require("express");
const { body, param } = require("express-validator");
const sheetController = require("../controllers/sheetController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router({ mergeParams: true });

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
 *     description: >
 *       Create a new sheet within a specified spreadsheet.
 *       **Emits Events:**
 *       - `sheetCreated`: Emitted after a sheet is created.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheetId": "string",
 *             "sheet": {
 *               "id": "string",
 *               "name": "string"
 *             }
 *           }
 *           ```
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
 *           format: uuid
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
 *                 message:
 *                   type: string
 *                   example: "Sheet created successfully"
 *                 sheetId:
 *                   type: string
 *                   format: uuid
 *                   example: "660e8400-e29b-41d4-a716-446655440111"
 *       '400':
 *         description: Bad request, invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Spreadsheet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  [
    param("spreadsheetId").isUUID().withMessage("Invalid spreadsheet ID format"),
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
 *     description: >
 *       Retrieve all sheets within a specified spreadsheet.
 *       **Emits Events:**
 *       - No events emitted.
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
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       '200':
 *         description: Sheets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sheets retrieved successfully"
 *                 sheets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "660e8400-e29b-41d4-a716-446655440111"
 *                       name:
 *                         type: string
 *                         example: "Sheet1"
 *       '403':
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Spreadsheet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/",
  [
    param("spreadsheetId").isUUID().withMessage("Invalid spreadsheet ID format"),
    validateRequest,
  ],
  sheetController.getSheets
);

/**
 * @swagger
 * /spreadsheets/{id}/sheets/{sheetId}:
 *   get:
 *     summary: Get a specific sheet by ID
 *     description: >
 *       Retrieve details of a specific sheet by its ID.
 *       **Emits Events:**
 *       - No events emitted.
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
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: sheetId
 *         required: true
 *         description: Sheet ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "660e8400-e29b-41d4-a716-446655440111"
 *     responses:
 *       '200':
 *         description: Sheet retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sheet retrieved successfully"
 *                 sheet:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "660e8400-e29b-41d4-a716-446655440111"
 *                     name:
 *                       type: string
 *                       example: "Sheet1"
 *       '403':
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Sheet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:sheetId",
  [
    param("spreadsheetId").isUUID().withMessage("Invalid spreadsheet ID format"),
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
 *     description: >
 *       Update the name of a specific sheet.
 *       **Emits Events:**
 *       - `sheetUpdated`: Emitted after a sheet is updated.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheetId": "string",
 *             "sheet": {
 *               "id": "string",
 *               "name": "string"
 *             }
 *           }
 *           ```
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
 *                 message:
 *                   type: string
 *                   example: "Sheet updated successfully"
 *                 sheetId:
 *                   type: string
 *                   format: uuid
 *                   example: "660e8400-e29b-41d4-a716-446655440111"
 *                 newName:
 *                   type: string
 *                   example: "Updated Sheet Name"
 *       '400':
 *         description: Bad request, invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Sheet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  "/:sheetId",
  [
    param("spreadsheetId").isUUID().withMessage("Invalid spreadsheet ID format"),
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
 *     description: >
 *       Delete a specific sheet within a spreadsheet.
 *       **Emits Events:**
 *       - `sheetDeleted`: Emitted after a sheet is deleted.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheetId": "string",
 *             "sheetId": "string"
 *           }
 *           ```
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sheet deleted successfully"
 *       '403':
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Sheet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/:sheetId",
  [
    param("spreadsheetId").isUUID().withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    validateRequest,
  ],
  sheetController.deleteSheet
);

module.exports = router;
