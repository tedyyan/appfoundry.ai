# 🤝 Contributing Guide

Welcome! We’re glad you’re interested in contributing to this open AI app platform.

This guide explains how to participate, contribute features, and get your work shipped to real users.

---

## 🧭 Core Principles

- Open source first
- Fast iteration
- Clear ownership
- Credit contributors
- Ship regularly

---

## 🛠️ Ways to Contribute

You can contribute by:
- Adding new feature modules
- Improving existing functionality
- Fixing bugs
- Improving UX/UI
- Writing documentation
- Proposing new ideas

---

## 💡 Proposing a Feature

For medium or large features:

1. Open an **Issue**
2. Describe:
   - What problem it solves
   - Target users
   - Rough technical approach
3. Discuss with maintainers
4. Start building

Small improvements can go straight to PR.

---

## 🧩 Feature Ownership

- Contributors retain copyright to their code
- All contributions are licensed under Apache-2.0
- Major feature authors may become module maintainers

---

## 🔁 Development Workflow

Here's the step-by-step process for contributing a new feature:

1. **Create a branch**
   - Fork the repository (if you haven't already)
   - Create a new feature branch from `main`

2. **Set up your Supabase instance**
   - Sign up for a free account at [supabase.com](https://supabase.com)
   - Create a new project (free tier is sufficient for development)
   - Get your Supabase URL and anon key

3. **Configure the app to use your Supabase**
   - Update the app configuration to point to your Supabase instance
   - This allows you to develop and test independently

4. **Develop your feature**
   - Use your preferred IDE (VS Code, Cursor, etc.) to add new features
   - Design your database schema (new tables, columns, etc.)
   - Implement the feature in the app code
   - Test thoroughly with your local Supabase instance

5. **Test with Expo**
   - Use Expo tools to test and simulate the app
   - Verify your feature works correctly on both iOS and Android simulators
   - Ensure all edge cases are handled

6. **Submit a Merge Request**
   - Once everything is working, submit a Pull/Merge Request
   - **Important**: Include your database schema changes in the PR description
     - Document new tables, columns, relationships
     - Include any migration SQL if applicable
     - Explain the schema design decisions
   - Clearly describe:
     - What the feature does
     - Why it's valuable
     - How to test it

7. **Review and Approval**
   - Maintainers will review your code and schema
   - Address any feedback or requested changes
   - Once approved, your feature will be merged

8. **Release**
   - Approved features are included in the **next monthly release**
   - The maintainer will apply the schema changes to the production database
   - Your feature will be shipped to real users!

---

## 🔁 Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Follow the [Development Workflow](#-development-workflow) above
4. Keep PRs focused and readable
5. Clearly describe:
   - What changed
   - Why it matters
   - **Database schema changes** (new tables, columns, etc.)
6. Submit the PR

Feedback is collaborative and respectful.

---

## 🚢 Shipping & Releases

- Accepted PRs are included in the **next monthly release**
- Contributors are credited in:
  - GitHub
  - Release notes
  - App credits (when applicable)

Your work will reach real users.

---

## 💰 Monetization & Transparency

- Core platform remains open source
- Infrastructure and publishing costs are covered by the project
- Monetization (if introduced) supports sustainability
- Contributors will never be locked out of their own code

---

## 🧠 Communication

- Use Issues for bugs & ideas
- Use Discussions for broader topics
- Be kind, constructive, and curious

---

## 🙌 Final Note

This project exists to prove:

> You don’t need a startup or a DevOps team to ship real AI apps.

Thanks for being part of it.
