#ifndef CSMC_H
#define CSMC_H

#include <IOKit/IOKitLib.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/// SMC result code returned when a key does not exist.
#define CSMC_RESULT_KEY_NOT_FOUND 0x84

/// Error returned by the csmc_* functions when the IOKit call succeeded but the SMC
/// itself rejected the request. The SMC result byte is stored in the low 8 bits.
#define CSMC_ERR_SMC_RESULT_BASE 0x10000

typedef struct {
    uint32_t dataSize;
    uint32_t dataType; // FourCC, e.g. 'flt ', 'ui8 ', 'fpe2'
    uint8_t dataAttributes;
} CSMCKeyInfo;

/// Opens a user-client connection to the AppleSMC service. Reads work for any user; writes need root.
kern_return_t csmc_open(io_connect_t *outConnection);
kern_return_t csmc_close(io_connect_t connection);

kern_return_t csmc_key_info(io_connect_t connection, uint32_t key, CSMCKeyInfo *outInfo);
/// Reads up to 32 bytes. `outInfo` receives the key's type and size.
kern_return_t csmc_read(io_connect_t connection, uint32_t key, CSMCKeyInfo *outInfo, uint8_t outBytes[32]);
/// Writes `size` bytes. `size` must match the key's dataSize.
kern_return_t csmc_write(io_connect_t connection, uint32_t key, const uint8_t *bytes, uint32_t size);
kern_return_t csmc_key_at_index(io_connect_t connection, uint32_t index, uint32_t *outKey);

typedef struct {
    char name[96];
    double celsius;
} CSMCTemperature;

/// Reads Apple Silicon temperature sensors through the private IOHIDEventSystem API
/// (PrimaryUsagePage 0xff00 / PrimaryUsage 5). Returns the number of entries written.
int csmc_hid_temperatures(CSMCTemperature *out, int maxCount);

#ifdef __cplusplus
}
#endif

#endif
