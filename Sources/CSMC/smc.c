#include "CSMC.h"

#include <string.h>

// Layout of the AppleSMC user-client parameter block (selector 2). This is the same
// 80-byte SMCKeyData_t used by Apple's historical smc.c and by Macs Fan Control.
enum {
    kSMCUserClientIndex = 2,
    kSMCCmdReadBytes = 5,
    kSMCCmdWriteBytes = 6,
    kSMCCmdReadIndex = 8,
    kSMCCmdReadKeyInfo = 9,
};

typedef struct {
    uint8_t major;
    uint8_t minor;
    uint8_t build;
    uint8_t reserved;
    uint16_t release;
} SMCVersion;

typedef struct {
    uint16_t version;
    uint16_t length;
    uint32_t cpuPLimit;
    uint32_t gpuPLimit;
    uint32_t memPLimit;
} SMCPLimitData;

typedef struct {
    uint32_t dataSize;
    uint32_t dataType;
    uint8_t dataAttributes;
} SMCKeyInfoData;

typedef struct {
    uint32_t key;
    SMCVersion vers;
    SMCPLimitData pLimitData;
    SMCKeyInfoData keyInfo;
    uint8_t result;
    uint8_t status;
    uint8_t data8;
    uint32_t data32;
    uint8_t bytes[32];
} SMCParamStruct;

_Static_assert(sizeof(SMCParamStruct) == 80, "SMCParamStruct must match the kernel's 80-byte layout");

static kern_return_t smc_call(io_connect_t connection, SMCParamStruct *input, SMCParamStruct *output) {
    size_t outputSize = sizeof(SMCParamStruct);
    kern_return_t kr = IOConnectCallStructMethod(connection, kSMCUserClientIndex, input, sizeof(SMCParamStruct),
                                                 output, &outputSize);
    if (kr != KERN_SUCCESS) return kr;
    if (output->result != 0) return CSMC_ERR_SMC_RESULT_BASE | output->result;
    return KERN_SUCCESS;
}

kern_return_t csmc_open(io_connect_t *outConnection) {
    io_service_t service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSMC"));
    if (service == IO_OBJECT_NULL) return kIOReturnNotFound;
    kern_return_t kr = IOServiceOpen(service, mach_task_self(), 0, outConnection);
    IOObjectRelease(service);
    return kr;
}

kern_return_t csmc_close(io_connect_t connection) {
    return IOServiceClose(connection);
}

kern_return_t csmc_key_info(io_connect_t connection, uint32_t key, CSMCKeyInfo *outInfo) {
    SMCParamStruct input;
    SMCParamStruct output;
    memset(&input, 0, sizeof(input));
    memset(&output, 0, sizeof(output));
    input.key = key;
    input.data8 = kSMCCmdReadKeyInfo;
    kern_return_t kr = smc_call(connection, &input, &output);
    if (kr != KERN_SUCCESS) return kr;
    outInfo->dataSize = output.keyInfo.dataSize;
    outInfo->dataType = output.keyInfo.dataType;
    outInfo->dataAttributes = output.keyInfo.dataAttributes;
    return KERN_SUCCESS;
}

kern_return_t csmc_read(io_connect_t connection, uint32_t key, CSMCKeyInfo *outInfo, uint8_t outBytes[32]) {
    CSMCKeyInfo info;
    kern_return_t kr = csmc_key_info(connection, key, &info);
    if (kr != KERN_SUCCESS) return kr;
    if (info.dataSize > 32) return kIOReturnOverrun;

    SMCParamStruct input;
    SMCParamStruct output;
    memset(&input, 0, sizeof(input));
    memset(&output, 0, sizeof(output));
    input.key = key;
    input.keyInfo.dataSize = info.dataSize;
    input.data8 = kSMCCmdReadBytes;
    kr = smc_call(connection, &input, &output);
    if (kr != KERN_SUCCESS) return kr;

    memset(outBytes, 0, 32);
    memcpy(outBytes, output.bytes, info.dataSize);
    if (outInfo) *outInfo = info;
    return KERN_SUCCESS;
}

kern_return_t csmc_write(io_connect_t connection, uint32_t key, const uint8_t *bytes, uint32_t size) {
    if (size > 32) return kIOReturnBadArgument;
    CSMCKeyInfo info;
    kern_return_t kr = csmc_key_info(connection, key, &info);
    if (kr != KERN_SUCCESS) return kr;
    if (info.dataSize != size) return kIOReturnBadArgument;

    SMCParamStruct input;
    SMCParamStruct output;
    memset(&input, 0, sizeof(input));
    memset(&output, 0, sizeof(output));
    input.key = key;
    input.data8 = kSMCCmdWriteBytes;
    input.keyInfo.dataSize = size;
    memcpy(input.bytes, bytes, size);
    return smc_call(connection, &input, &output);
}

kern_return_t csmc_key_at_index(io_connect_t connection, uint32_t index, uint32_t *outKey) {
    SMCParamStruct input;
    SMCParamStruct output;
    memset(&input, 0, sizeof(input));
    memset(&output, 0, sizeof(output));
    input.data8 = kSMCCmdReadIndex;
    input.data32 = index;
    kern_return_t kr = smc_call(connection, &input, &output);
    if (kr != KERN_SUCCESS) return kr;
    *outKey = output.key;
    return KERN_SUCCESS;
}
