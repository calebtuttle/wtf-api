const ethers = require('ethers');
const Buffer = require('buffer/').Buffer

// import { fixedBufferXOR as xor, sandwichIDWithBreadFromContract, padBase64, hexToString, searchForPlainTextInBase64 } from 'wtfprotocol-helpers';
const { hexToString } = require('wtfprotocol-helpers');
const {
  ConnectionFailedError,
  UnsupportedNetworkError,
  UnsupportedServiceError,
  CredentialsNotFoundError,
  AddressNotFoundError
} = require('./errors');

const vjwtABI = require('./contracts/VerifyJWT.json');
const idAggABI = require('./contracts/IdentityAggregator.json');
// TODO: contractAddresses contains mock addresses. Update the json file with deployed contract addresses
const contractAddresses = require('./contracts/contractAddresses.json');
const supportedNetworks = ['ethereum'];
const supportedServices = ['orcid', 'google'];
const idAggStr = 'IdentityAggregator';
const vjwtStr = 'VerifyJWT';

// let provider = new ethers.providers.JsonRpcProvider(process.env.MORALIS_NODE_URL);
let provider = ethers.getDefaultProvider()

const getIdAggregator = (network) => {
  const idAggregatorAddr = contractAddresses[idAggStr][network];
  if (idAggregatorAddr){
    return new ethers.Contract(idAggregatorAddr, idAggABI, provider);
  }
  else {
    throw UnsupportedNetworkError(network);
  }
}

const getVerifyJWT = (network, service) => {
  const vjwtAddressesOnNetwork = contractAddresses[vjwtStr][network];
  if (!vjwtAddressesOnNetwork) {
    throw UnsupportedNetworkError(network);
  }

  const vjwtAddr = vjwtAddressesOnNetwork[service];
  if (!vjwtAddr){
    throw UnsupportedServiceError(network, service);
  }
  else {
    return new ethers.Contract(vjwtAddr, vjwtABI, provider);
  }
}

const getCreds = async (vjwt, userAddress) => {
  const credsBytes = await vjwt.credsForAddress(userAddress);
  if (!credsBytes) {
    throw CredentialsNotFoundError(network, service, userAddress);
  }
  else {
    return hexToString(credsBytes);
  }
}

const getAddress = async (vjwt, encodedCreds) => {
  const address = await vjwt.addressForCreds(encodedCreds);
  if (!address) {
    throw AddressNotFoundError(network, service, userAddress);
  }
  else {
    return address;
  }
}

/**
 * Specify the URL of the JSON RPC provider used by WTF.
 * @param {string} rpcURL The provider URL
 */
exports.setProviderURL = async (rpcURL) => {
  try {
    provider = new ethers.providers.JsonRpcProvider(rpcURL)
  }
  catch (err) {
    throw ConnectionFailedError()
  }
}

/**
 * Get the credentials issued by a specific service that are associated
 * with a user's address on a specific network.
 * @param {string} address User's crypto address
 * @param {string} network The blockchain network to query
 * @param {string} service The platform that issued the credentials (e.g., 'google')
 * @returns The user's credentials (e.g., 'xyz@gmail.com')
 */
exports.credentialsForAddress = async (address, network, service) => {
  // const idAggregator = await getIdAggregator(network);
  const vjwt = getVerifyJWT(network, service);
  return await getCreds(vjwt, address)
}

/**
 * Get the address associated with specific credentials that were issued
 * by a specific service on a specific network.
 * @param {string} network The blockchain network to query
 * @param {string} creds The user's credentials (e.g., 'xyz@gmail.com')
 * @param {string} service The platform that issued the credentials (e.g., 'google')
 * @returns The user's crypto address
 */
exports.addressForCredentials = async (network, creds, service) => {
  // const idAggregator = await getIdAggregator(network);
  const vjwt = getVerifyJWT(network, service);
  const encodedCreds = Buffer.from(creds);
  return await getAddress(vjwt, encodedCreds);
}

/**
 * Get all every registered user address on WTF for every supported network and service.
 * @return Dictionary of networks and user addresses with shape: {'network': {'service': ['0xabc...',],},}
 */
exports.getAllUserAddresses = async () => {
  let userAddresses = {};
  for (network of supportedNetworks) {
    userAddresses[network] = {};
    for (keyword of supportedServices) {
      const vjwtAddr = contractAddresses[vjwtStr][network][keyword];
      const vjwt = new ethers.Contract(vjwtAddr, vjwtABI, provider);
      const addresses = await vjwt.getRegisteredAddresses();
      userAddresses[network][keyword] = addresses;
    }
  }
  return userAddresses;
}
