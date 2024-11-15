const express = require("express");
const { body, param } = require("express-validator");
const spreadsheetController = require("../controllers/spreadsheetController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Spreadsheets
 *   description: Spreadsheet management
 */

/**
 * @swagger
 * /spreadsheets:
 *   post:
 *     summary: Create a new spreadsheet
 *     tags: [Spreadsheets]
 *     security:
 *       - bearerAuth: []
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
 *                 example: "My Spreadsheet"
 *     responses:
 *       '201':
 *         description: Spreadsheet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 spreadsheet:
 *                   $ref: '#/components/schemas/Spreadsheet'
 *       '400':
 *         description: Bad request, invalid input
 */
router.post(
  "/",
  [
    body("name")
      .isLength({ min: 1 })
      .withMessage("Spreadsheet name is required"),
  ],
  spreadsheetController.createSpreadsheet
);

/**
 * @swagger
 * /spreadsheets:
 *   get:
 *     summary: Get all spreadsheets the user owns or collaborates on
 *     tags: [Spreadsheets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of spreadsheets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ownedSpreadsheets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Spreadsheet'
 *                 collaboratedSpreadsheets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Spreadsheet'
 */
router.get("/", spreadsheetController.getSpreadsheets);

/**
 * @swagger
 * /spreadsheets/{id}:
 *   get:
 *     summary: Get a spreadsheet by ID
 *     tags: [Spreadsheets]
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
 *         description: Spreadsheet details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 spreadsheet:
 *                   $ref: '#/components/schemas/Spreadsheet'
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet not found
 */
router.get(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
  ],
  spreadsheetController.getSpreadsheetById
);

/**
 * @swagger
 * /spreadsheets/{id}:
 *   put:
 *     summary: Update a spreadsheet's name
 *     tags: [Spreadsheets]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Spreadsheet Name"
 *     responses:
 *       '200':
 *         description: Spreadsheet updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 spreadsheet:
 *                   $ref: '#/components/schemas/Spreadsheet'
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet not found
 */
router.put(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    body("name")
      .optional()
      .isLength({ min: 1 })
      .withMessage("Spreadsheet name cannot be empty"),
  ],
  spreadsheetController.updateSpreadsheet
);

/**
 * @swagger
 * /spreadsheets/{id}:
 *   delete:
 *     summary: Delete a spreadsheet
 *     tags: [Spreadsheets]
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
 *         description: Spreadsheet deleted successfully
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet not found
 */
router.delete(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
  ],
  spreadsheetController.deleteSpreadsheet
);

/**
 * @swagger
 * /spreadsheets/{id}/add-collaborator:
 *   post:
 *     summary: Add a collaborator to a spreadsheet
 *     tags: [Spreadsheets]
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
 *               - collaboratorEmail
 *             properties:
 *               collaboratorEmail:
 *                 type: string
 *                 example: "collaborator@example.com"
 *     responses:
 *       '200':
 *         description: Collaborator added successfully
 *       '400':
 *         description: Bad request, invalid input
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet or collaborator not found
 */
router.post(
  "/:id/add-collaborator",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    body("collaboratorEmail")
      .isEmail()
      .withMessage("Valid collaborator email is required"),
  ],
  spreadsheetController.addCollaborator
);

/**
 * @swagger
 * /spreadsheets/{id}/remove-collaborator:
 *   delete:
 *     summary: Remove a collaborator from a spreadsheet
 *     tags: [Spreadsheets]
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
 *               - collaboratorId
 *             properties:
 *               collaboratorId:
 *                 type: string
 *                 example: "660e8400-e29b-41d4-a716-446655440111"
 *     responses:
 *       '200':
 *         description: Collaborator removed successfully
 *       '400':
 *         description: Bad request, invalid input
 *       '403':
 *         description: Access denied
 *       '404':
 *         description: Spreadsheet or collaborator not found
 */
router.delete(
  "/:id/remove-collaborator",
  [
    param("id").isUUID().withMessage("Invalid spreadsheet ID format"),
    body("collaboratorId")
      .isUUID()
      .withMessage("Valid collaborator ID is required"),
  ],
  spreadsheetController.removeCollaborator
);

module.exports = router;
