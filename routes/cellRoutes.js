// routes/cellRoutes.js

const express = require("express");
const router = express.Router({ mergeParams: true });
const { body, param } = require("express-validator");
const cellController = require("../controllers/cellController");
const validateRequest = require("../middleware/validateRequest");
const { bulkUpdateCellsValidator } = require("../validators/cellValidators");

/**
 * @swagger
 * tags:
 *   name: Cells
 *   description: API endpoints for managing cells in a spreadsheet
 */

/**
 * @swagger
 * /spreadsheets/{spreadsheetId}/sheets/{sheetId}/cells:
 *   post:
 *     summary: Create or update a cell
 *     description: Create a new cell or update an existing cell in a sheet.
 *     tags: [Cells]
 *     parameters:
 *       - in: path
 *         name: spreadsheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the spreadsheet
 *       - in: path
 *         name: sheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the sheet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - row
 *               - column
 *             properties:
 *               row:
 *                 type: integer
 *                 minimum: 1
 *                 description: Row number (positive integer)
 *               column:
 *                 type: integer
 *                 minimum: 1
 *                 description: Column number (positive integer)
 *               content:
 *                 type: string
 *                 nullable: true
 *                 description: Content of the cell
 *               formula:
 *                 type: string
 *                 nullable: true
 *                 description: Formula of the cell
 *               hyperlink:
 *                 type: string
 *                 nullable: true
 *                 description: Hyperlink of the cell
 *     responses:
 *       200:
 *         description: Cell created or updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cell:
 *                   $ref: '#/components/schemas/Cell'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied to modify cells
 *       404:
 *         description: Spreadsheet or sheet not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  [
    param("spreadsheetId")
      .isUUID()
      .withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    body("row")
      .isInt({ min: 1 })
      .withMessage("Row number must be a positive integer"),
    body("column")
      .isInt({ min: 1 })
      .withMessage("Column number must be a positive integer"),
    validateRequest,
  ],
  cellController.createOrUpdateCell
);

/**
 * @swagger
 * /spreadsheets/{spreadsheetId}/sheets/{sheetId}/cells:
 *   get:
 *     summary: Get all cells in a sheet
 *     description: Retrieve all cells within a specific sheet.
 *     tags: [Cells]
 *     parameters:
 *       - in: path
 *         name: spreadsheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the spreadsheet
 *       - in: path
 *         name: sheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the sheet
 *     responses:
 *       200:
 *         description: A list of cells
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cells:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cell'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied to get cells
 *       404:
 *         description: Spreadsheet or sheet not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  [
    param("spreadsheetId")
      .isUUID()
      .withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    validateRequest,
  ],
  cellController.getCells
);

/**
 * @swagger
 * /spreadsheets/{spreadsheetId}/sheets/{sheetId}/cells/{row}/{column}:
 *   get:
 *     summary: Get a specific cell
 *     description: Retrieve a specific cell by row and column numbers.
 *     tags: [Cells]
 *     parameters:
 *       - in: path
 *         name: spreadsheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the spreadsheet
 *       - in: path
 *         name: sheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the sheet
 *       - in: path
 *         name: row
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Row number (positive integer)
 *       - in: path
 *         name: column
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Column number (positive integer)
 *     responses:
 *       200:
 *         description: Cell retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cell:
 *                   $ref: '#/components/schemas/Cell'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied to get cell
 *       404:
 *         description: Spreadsheet, sheet, or cell not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:row/:column",
  [
    param("spreadsheetId")
      .isUUID()
      .withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    param("row")
      .isInt({ min: 1 })
      .withMessage("Row number must be a positive integer"),
    param("column")
      .isInt({ min: 1 })
      .withMessage("Column number must be a positive integer"),
    validateRequest,
  ],
  cellController.getCell
);

/**
 * @swagger
 * /spreadsheets/{spreadsheetId}/sheets/{sheetId}/cells/{row}/{column}:
 *   put:
 *     summary: Update a specific cell
 *     description: Create a new cell or update an existing cell's content, formula, or hyperlink within a specific sheet and spreadsheet.
 *     tags: [Cells]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spreadsheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the spreadsheet
 *       - in: path
 *         name: sheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the sheet
 *       - in: path
 *         name: row
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Row number (positive integer)
 *       - in: path
 *         name: column
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Column number (positive integer)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 nullable: true
 *                 description: Content of the cell
 *               formula:
 *                 type: string
 *                 nullable: true
 *                 description: Formula of the cell
 *               hyperlink:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: Hyperlink of the cell
 *     responses:
 *       200:
 *         description: Cell created or updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cell:
 *                   $ref: '#/components/schemas/Cell'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                       param:
 *                         type: string
 *                       location:
 *                         type: string
 *       403:
 *         description: Access denied to modify cells
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied to modify cells"
 *       404:
 *         description: Spreadsheet or sheet not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Spreadsheet or sheet not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put(
  "/:row/:column",
  [
    param("spreadsheetId").isUUID().withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    param("row").isInt({ min: 1 }).withMessage("Row must be a positive integer"),
    param("column").isInt({ min: 1 }).withMessage("Column must be a positive integer"),
    body("content")
      .optional()
      .custom((value) => {
        if (value === null || typeof value === "string") {
          return true;
        }
        throw new Error("Content must be a string or null");
      }),
    body("formula")
      .optional()
      .custom((value) => {
        if (value === null || typeof value === "string") {
          return true;
        }
        throw new Error("Formula must be a string or null");
      }),
    body("hyperlink")
      .optional()
      .custom((value) => {
        if (value === null || typeof value === "string") {
          return true;
        }
        throw new Error("Hyperlink must be a string or null");
      }),
    validateRequest,
  ],
  cellController.createOrUpdateCell
);

/**
 * @swagger
 * /spreadsheets/{spreadsheetId}/sheets/{sheetId}/cells:
 *   put:
 *     summary: Bulk create or update cells within a sheet
 *     tags: [Cells]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spreadsheetId
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
 *           example: "660e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cells
 *             properties:
 *               cells:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - row
 *                     - column
 *                   properties:
 *                     row:
 *                       type: integer
 *                       example: 1
 *                     column:
 *                       type: integer
 *                       example: 1
 *                     content:
 *                       type: string
 *                       example: "Hello World"
 *                     formula:
 *                       type: string
 *                       example: "=SUM(A1:A10)"
 *                     hyperlink:
 *                       type: string
 *                       format: uri
 *                       example: "https://example.com"
 *     responses:
 *       '200':
 *         description: Cells updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cells updated successfully"
 *                 cells:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cell'
 *       '400':
 *         description: Bad request, invalid input
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet or sheet not found
 */
router.put(
  "/",
  bulkUpdateCellsValidator, 
  validateRequest, 
  cellController.bulkCreateOrUpdateCells
);

/**
 * @swagger
 * /spreadsheets/{spreadsheetId}/sheets/{sheetId}/cells/{row}/{column}:
 *   delete:
 *     summary: Delete a cell
 *     description: Delete a specific cell by row and column numbers.
 *     tags: [Cells]
 *     parameters:
 *       - in: path
 *         name: spreadsheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the spreadsheet
 *       - in: path
 *         name: sheetId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the sheet
 *       - in: path
 *         name: row
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Row number (positive integer)
 *       - in: path
 *         name: column
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Column number (positive integer)
 *     responses:
 *       200:
 *         description: Cell deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cell deleted successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Only owner can delete cells
 *       404:
 *         description: Spreadsheet, sheet, or cell not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:row/:column",
  [
    param("spreadsheetId")
      .isUUID()
      .withMessage("Invalid spreadsheet ID format"),
    param("sheetId").isUUID().withMessage("Invalid sheet ID format"),
    param("row")
      .isInt({ min: 1 })
      .withMessage("Row number must be a positive integer"),
    param("column")
      .isInt({ min: 1 })
      .withMessage("Column number must be a positive integer"),
    validateRequest,
  ],
  cellController.deleteCell
);

module.exports = router;
