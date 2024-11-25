// tests/auth.test.js

const request = require("supertest");
const app = require("../../app");
const { sequelize, User } = require("../../models");
const jwt = require("jsonwebtoken");

// Set JWT_SECRET for test environment if not set
process.env.JWT_SECRET = process.env.JWT_SECRET || "your_test_jwt_secret";
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "ref_token";

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Authentication Endpoints", () => {
  const userData = {
    username: "testuser",
    email: "testuser@example.com",
    password: "testpassword",
  };
  let accessToken;
  let refreshToken;

  describe("Registration", () => {
    it("should register a new user with valid data", async () => {
      const res = await request(app).post("/auth/register").send(userData);
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty("userId");
      expect(res.body.message).toBe("User registered successfully");
    });

    it("should not register a user with existing username or email", async () => {
      const res = await request(app).post("/auth/register").send(userData);
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toBe("Username or email already exists");
    });
  });

  describe("Login", () => {
    it("should login an existing user with correct credentials", async () => {
      const res = await request(app).post("/auth/login").send({
        username: userData.username,
        password: userData.password,
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;

      // console.log("Assigned Refresh Token:", refreshToken);
    });

    it("should not login with incorrect password", async () => {
      const res = await request(app).post("/auth/login").send({
        username: userData.username,
        password: "wrongpassword",
      });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toBe("Invalid password");
    });
  });

  describe("Token Refresh", () => {
    it("should refresh the access token with a valid refresh token", async () => {
      const res = await request(app)
        .post("/auth/refresh-token")
        .send({ refreshToken });
      // console.log("Response Status:", res.statusCode);
      // console.log("Response Body:", res.body);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(typeof res.body.accessToken).toBe("string");
      accessToken = res.body.accessToken;
    });

    it("should not refresh token with invalid refresh token", async () => {
      const res = await request(app)
        .post("/auth/refresh-token")
        .send({ refreshToken: "invalidtoken" });
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toBe("Failed to authenticate refresh token");
    });
  });
});
