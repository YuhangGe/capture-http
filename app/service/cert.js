const pki = require('node-forge/lib/pki');
const sha256 = require('node-forge/lib/sha256');

export function generateCA(attrs) {
  const keys = pki.rsa.generateKeyPair(1024);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '10000';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true
  }, {
    name: 'nsCertType',
    client: true,
    server: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true
  }, {
    name: 'subjectKeyIdentifier'
  }]);
  // FIXME: add authorityKeyIdentifier extension

  // self-sign certificate
  cert.sign(keys.privateKey, sha256.create());

  // PEM-format keys and cert
  return {
    privateKey: pki.privateKeyToPem(keys.privateKey),
    publicKey: pki.publicKeyToPem(keys.publicKey),
    certificate: pki.certificateToPem(cert)
  };
}

export function generateDomainCert(domain, ca) {

  const caCert = pki.certificateFromPem(ca.certificate);
  const caKey = pki.privateKeyFromPem(ca.privateKey);
  const keys = pki.rsa.generateKeyPair(1024);
  const csr = pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([{
    name: 'commonName',
    value: domain
  }, {
    name: 'countryName',
    value: 'CN'
  }, {
    shortName: 'ST',
    value: 'SiChuan'
  }, {
    name: 'localityName',
    value: 'ChengDu'
  }, {
    name: 'organizationName',
    value: 'Capture HTTP(s) Ltd'
  }, {
    shortName: 'OU',
    value: 'capture'
  }]);

  // sign certification request
  csr.sign(keys.privateKey/*, forge.md.sha256.create()*/);
  console.log('Certification request (CSR) created.');

  const cert = pki.createCertificate();
  cert.serialNumber = '10001';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
  // subject from CSR
  cert.setSubject(csr.subject.attributes);
  // issuer from CA
  cert.setIssuer(caCert.subject.attributes);
  // set appropriate extensions here (some examples below)
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }]);
  cert.publicKey = csr.publicKey;
  cert.sign(caKey, sha256.create());

  return {
    privateKey: pki.privateKeyToPem(keys.privateKey),
    publicKey: pki.publicKeyToPem(keys.publicKey),
    certificate: pki.certificateToPem(cert)
  };
}
