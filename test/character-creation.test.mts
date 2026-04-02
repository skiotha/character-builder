import { validateCharacterCreation } from "../src/models/validation.mts";

interface TestCase {
  name: string;
  data: Record<string, unknown>;
  shouldPass: boolean;
  expectedError?: string;
}

async function runCreationTests(): Promise<void> {
  console.log("Running character creation tests...");

  const testCases: TestCase[] = [
    {
      name: "Valid character",
      data: {
        characterName: "Arianna",
        attributes: {
          primary: {
            accurate: 10,
            cunning: 8,
            discreet: 7,
            alluring: 9,
            quick: 6,
            resolute: 8,
            vigilant: 7,
            strong: 9,
          },
        },
      },
      shouldPass: true,
    },
    {
      name: "Missing required field",
      data: {
        attributes: { primary: { accurate: 10 } },
      },
      shouldPass: false,
      expectedError: "characterName",
    },
    {
      name: "Attribute exceeds budget",
      data: {
        characterName: "Overpowered",
        attributes: {
          primary: {
            accurate: 15,
            cunning: 15,
            discreet: 15,
            alluring: 15,
            quick: 15,
            resolute: 15,
            vigilant: 15,
            strong: 15,
          },
        },
      },
      shouldPass: false,
      expectedError: "exceed budget",
    },
    {
      name: "Invalid field value",
      data: {
        characterName: "Test",
        attributes: {
          primary: { accurate: 20 },
        },
      },
      shouldPass: false,
      expectedError: "between 5 and 15",
    },
  ];

  for (const test of testCases) {
    const result = validateCharacterCreation(
      test.data,
      "test_player",
      "Test Player",
    );

    if (test.shouldPass && !result.success) {
      console.error(
        `❌ ${test.name}: Expected to pass but failed:`,
        result.errors,
      );
    } else if (!test.shouldPass && result.success) {
      console.error(`❌ ${test.name}: Expected to fail but passed`);
    } else if (!test.shouldPass && test.expectedError) {
      const hasExpectedError = result.errors.some(
        (err) =>
          err.error?.includes(test.expectedError!) ||
          err.field?.includes(test.expectedError!),
      );

      if (!hasExpectedError) {
        console.error(
          `❌ ${test.name}: Missing expected error "${test.expectedError}"`,
        );
      } else {
        console.log(`✅ ${test.name}: Failed as expected`);
      }
    } else {
      console.log(`✅ ${test.name}: Passed`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCreationTests();
}
