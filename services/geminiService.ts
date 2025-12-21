import { GoogleGenAI, Type } from "@google/genai";
import { Contract, MedicalDevice, MaintenanceType } from '../types';

/**
 * Analyzes raw text from a service contract and extracts structured data.
 */
export const analyzeContractText = async (text: string): Promise<Partial<Contract>> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract contract details from the following text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            provider: { type: Type.STRING },
            contractNumber: { type: Type.STRING },
            startDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
            endDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
            coverageDetails: { type: Type.STRING },
            contactPhone: { type: Type.STRING },
            annualCost: { type: Type.NUMBER },
          },
          required: ["provider", "coverageDetails"]
        }
      }
    });

    const result = response.text;
    return result ? JSON.parse(result) : {};
  } catch (error) {
    console.error("Error analyzing contract:", error);
    throw error;
  }
};

/**
 * Generates a comprehensive maintenance plan for a list of devices.
 */
export const generateBulkMaintenancePlan = async (devices: MedicalDevice[]): Promise<any[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const deviceSummary = devices.map(d => `${d.name} (${d.model}) in ${d.department}`).join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a preventive maintenance plan for these hospital devices. For each device, suggest a 'nextScheduledDate' within the next 6 months and clinical tasks.
      
      Devices:
      ${deviceSummary}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              deviceName: { type: Type.STRING },
              deviceId: { type: Type.STRING, description: "Must match original ID if possible, otherwise ignored" },
              nextScheduledDate: { type: Type.STRING, description: "YYYY-MM-DD" },
              tasks: { type: Type.STRING },
              frequency: { type: Type.STRING },
              priority: { type: Type.STRING, description: "High, Medium, Low" }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Plan generation error:", error);
    return [];
  }
};

/**
 * Suggests a maintenance schedule based on device type.
 */
export const suggestMaintenanceSchedule = async (deviceName: string, model: string): Promise<{
  frequency: string;
  tasks: string[];
  recommendedType: string;
}> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest a maintenance schedule for a medical device. Device Name: ${deviceName}, Model: ${model}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            frequency: { type: Type.STRING },
            tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedType: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error suggesting maintenance:", error);
    return { frequency: "Annually", tasks: ["General Inspection"], recommendedType: "Preventive" };
  }
};