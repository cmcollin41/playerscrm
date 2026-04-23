import {
  DomainResponse,
  DomainConfigResponse,
  DomainVerificationResponse,
} from "@/lib/types"

const PROJECT_ID = process.env.PROJECT_ID_VERCEL!
const TEAM_ID = process.env.TEAM_ID_VERCEL!
const AUTH_TOKEN = process.env.AUTH_BEARER_TOKEN!

export const addDomainToVercel = async (domain: string) => {
  return await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`,
    {
      body: JSON.stringify({ name: domain }),
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  ).then((res) => res.json())
}

export const removeDomainFromVercelProject = async (domain: string) => {
  return await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/${domain}?teamId=${TEAM_ID}`,
    {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      method: "DELETE",
    },
  ).then((res) => res.json())
}

export const removeDomainFromVercelTeam = async (domain: string) => {
  return await fetch(
    `https://api.vercel.com/v6/domains/${domain}?teamId=${TEAM_ID}`,
    {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      method: "DELETE",
    },
  ).then((res) => res.json())
}

export const getDomainResponse = async (
  domain: string,
): Promise<DomainResponse & { error: { code: string; message: string } }> => {
  return await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/${domain}?teamId=${TEAM_ID}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  ).then((res) => res.json())
}

export const getConfigResponse = async (
  domain: string,
): Promise<DomainConfigResponse> => {
  return await fetch(
    `https://api.vercel.com/v6/domains/${domain}/config?teamId=${TEAM_ID}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  ).then((res) => res.json())
}

export const verifyDomain = async (
  domain: string,
): Promise<DomainVerificationResponse> => {
  return await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/${domain}/verify?teamId=${TEAM_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  ).then((res) => res.json())
}

export const getSubdomain = (name: string, apexName: string) => {
  if (name === apexName) return null
  return name.slice(0, name.length - apexName.length - 1)
}

export const getApexDomain = (url: string) => {
  let domain
  try {
    domain = new URL(url).hostname
  } catch (e) {
    return ""
  }
  const parts = domain.split(".")
  if (parts.length > 2) {
    return parts.slice(-2).join(".")
  }
  return domain
}

export const validDomainRegex = new RegExp(
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
)
