// routes/spreadsheetRoutes.js

const express = require("express");
const { body, param } = require("express-validator");
const spreadsheetController = require("../controllers/spreadsheetController");
const validateRequest = require("../middleware/validateRequest");

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
 *     description: >
 *       Create a new spreadsheet with a default sheet.
 *       **Emits Events:**
 *       - `spreadsheetCreated`: Emitted after a spreadsheet is created.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheet": {
 *               "id": "string",
 *               "name": "string",
 *               "ownerId": "string"
 *             }
 *           }
 *           ```
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
 *                 message:
 *                   type: string
 *                   example: "Spreadsheet created successfully"
 *                 spreadsheetId:
 *                   type: string
 *                   format: uuid
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *       '400':
 *         description: Bad request, invalid input
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
 *     description: >
 *       Retrieve all spreadsheets that the authenticated user owns or collaborates on.
 *       **Emits Events:**
 *       - No events emitted.
 *     tags: [Spreadsheets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Spreadsheets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Spreadsheets retrieved successfully"
 *                 ownedSpreadsheets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
 *                       name:
 *                         type: string
 *                         example: "Owner's Spreadsheet"
 *                 collaboratedSpreadsheets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "770e8400-e29b-41d4-a716-446655440222"
 *                       name:
 *                         type: string
 *                         example: "Collaborator's Spreadsheet"
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", spreadsheetController.getSpreadsheets);

/**
 * @swagger
 * /spreadsheets/{id}:
 *   get:
 *     summary: Get a spreadsheet by ID
 *     description: >
 *       Retrieve detailed information about a specific spreadsheet.
 *       **Emits Events:**
 *       - No events emitted.
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
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       '200':
 *         description: Spreadsheet details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Spreadsheet details retrieved successfully"
 *                 spreadsheet:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     name:
 *                       type: string
 *                       example: "My Spreadsheet"
 *                     ownerId:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     Sheets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "660e8400-e29b-41d4-a716-446655440111"
 *                           name:
 *                             type: string
 *                             example: "Sheet1"
 *                     Collaborators:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "223e4567-e89b-12d3-a456-426614174111"
 *                           username:
 *                             type: string
 *                             example: "collaboratorUser"
 *                           email:
 *                             type: string
 *                             format: email
 *                             example: "collab@example.com"
 *                     owner:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           example: "123e4567-e89b-12d3-a456-426614174000"
 *                         username:
 *                           type: string
 *                           example: "ownerUser"
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: "owner@example.com"
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
 *       '400':
 *         description: Bad request, invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:id",
  [param("id").isUUID().withMessage("Invalid spreadsheet ID format")],
  spreadsheetController.getSpreadsheetById
);

/**
 * @swagger
 * /spreadsheets/{id}:
 *   put:
 *     summary: Update a spreadsheet's name
 *     description: >
 *       Update the name of a specific spreadsheet.
 *       **Emits Events:**
 *       - `spreadsheetUpdated`: Emitted after a spreadsheet is updated.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheetId": "string",
 *             "newName": "string"
 *           }
 *           ```
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
 *                 message:
 *                   type: string
 *                   example: "Spreadsheet updated successfully"
 *                 spreadsheetId:
 *                   type: string
 *                   format: uuid
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 newName:
 *                   type: string
 *                   example: "Updated Spreadsheet Name"
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
 *     description: >
 *       Delete a specific spreadsheet. Only the owner can perform this action.
 *       **Emits Events:**
 *       - `spreadsheetDeleted`: Emitted after a spreadsheet is deleted.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheetId": "string"
 *           }
 *           ```
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Spreadsheet deleted successfully"
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
 *       '400':
 *         description: Invalid spreadsheet ID
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
router.delete(
  "/:id",
  [param("id").isUUID().withMessage("Invalid spreadsheet ID format")],
  spreadsheetController.deleteSpreadsheet
);

/**
 * @swagger
 * /spreadsheets/{id}/add-collaborator:
 *   post:
 *     summary: Add a collaborator to a spreadsheet
 *     description: >
 *       Add a new collaborator to a specific spreadsheet. Only the owner can perform this action.
 *       **Emits Events:**
 *       - `collaboratorAdded`: Emitted after a collaborator is added.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheetId": "string",
 *             "collaborator": {
 *               "id": "string",
 *               "email": "string"
 *             }
 *           }
 *           ```
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
 *                 format: email
 *                 example: "collaborator@example.com"
 *     responses:
 *       '200':
 *         description: Collaborator added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Collaborator added successfully"
 *                 collaboratorId:
 *                   type: string
 *                   format: uuid
 *                   example: "223e4567-e89b-12d3-a456-426614174111"
 *       '400':
 *         description: Bad request, invalid input or collaborator already exists
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
 *         description: Spreadsheet or collaborator not found
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
  "/:id/add-collaborator",
  [
    param("id")
      .isUUID()
      .withMessage("Invalid spreadsheet ID format"),
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
 *     summary: Remove a collaborator from a spreadsheet by email
 *     description: >
 *       Remove an existing collaborator from a specific spreadsheet. Only the owner can perform this action.
 *       **Emits Events:**
 *       - `collaboratorRemoved`: Emitted after a collaborator is removed.
 *         - **Data Payload:**
 *           ```json
 *           {
 *             "spreadsheetId": "string",
 *             "collaborator": {
 *               "id": "string",
 *               "email": "string"
 *             }
 *           }
 *           ```
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
 *                 format: email
 *                 example: "collaborator@example.com"
 *     responses:
 *       '200':
 *         description: Collaborator removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Collaborator removed successfully"
 *       '400':
 *         description: Bad request, invalid input or collaborator not a member
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
 *         description: Spreadsheet or collaborator not found
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
router.delete(
  "/:id/remove-collaborator",
  [
    param("id")
      .isUUID()
      .withMessage("Invalid spreadsheet ID format"),
    body("collaboratorEmail")
      .isEmail()
      .withMessage("Valid collaborator email is required"),
  ],
  spreadsheetController.removeCollaborator
);

module.exports = router;
