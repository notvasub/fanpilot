#include "CSMC.h"

#include <string.h>

// Private IOKit HID event-system API. These symbols are exported by IOKit.framework but
// have no public header. Apple Silicon exposes its die/PMU temperature sensors here.
typedef struct __IOHIDEventSystemClient *IOHIDEventSystemClientRef;
typedef struct __IOHIDServiceClient *IOHIDServiceClientRef;
typedef struct __IOHIDEvent *IOHIDEventRef;

extern IOHIDEventSystemClientRef IOHIDEventSystemClientCreate(CFAllocatorRef allocator);
extern int IOHIDEventSystemClientSetMatching(IOHIDEventSystemClientRef client, CFDictionaryRef matching);
extern CFArrayRef IOHIDEventSystemClientCopyServices(IOHIDEventSystemClientRef client);
extern CFTypeRef IOHIDServiceClientCopyProperty(IOHIDServiceClientRef service, CFStringRef key);
extern IOHIDEventRef IOHIDServiceClientCopyEvent(IOHIDServiceClientRef service, int64_t type, int32_t options,
                                                 int64_t timestamp);
extern double IOHIDEventGetFloatValue(IOHIDEventRef event, int32_t field);

enum {
    kHIDPageAppleVendor = 0xff00,
    kHIDUsageAppleVendorTemperatureSensor = 5,
    kIOHIDEventTypeTemperature = 15,
};

static IOHIDEventSystemClientRef copy_client(void) {
    static IOHIDEventSystemClientRef client = NULL;
    if (client) return client;

    client = IOHIDEventSystemClientCreate(kCFAllocatorDefault);
    if (!client) return NULL;

    int page = kHIDPageAppleVendor;
    int usage = kHIDUsageAppleVendorTemperatureSensor;
    CFNumberRef pageNumber = CFNumberCreate(kCFAllocatorDefault, kCFNumberIntType, &page);
    CFNumberRef usageNumber = CFNumberCreate(kCFAllocatorDefault, kCFNumberIntType, &usage);
    const void *keys[] = {CFSTR("PrimaryUsagePage"), CFSTR("PrimaryUsage")};
    const void *values[] = {pageNumber, usageNumber};
    CFDictionaryRef matching = CFDictionaryCreate(kCFAllocatorDefault, keys, values, 2, &kCFTypeDictionaryKeyCallBacks,
                                                  &kCFTypeDictionaryValueCallBacks);
    IOHIDEventSystemClientSetMatching(client, matching);
    CFRelease(matching);
    CFRelease(pageNumber);
    CFRelease(usageNumber);
    return client;
}

int csmc_hid_temperatures(CSMCTemperature *out, int maxCount) {
    IOHIDEventSystemClientRef client = copy_client();
    if (!client) return 0;

    CFArrayRef services = IOHIDEventSystemClientCopyServices(client);
    if (!services) return 0;

    int count = 0;
    CFIndex total = CFArrayGetCount(services);
    for (CFIndex i = 0; i < total && count < maxCount; i++) {
        IOHIDServiceClientRef service = (IOHIDServiceClientRef)CFArrayGetValueAtIndex(services, i);
        IOHIDEventRef event = IOHIDServiceClientCopyEvent(service, kIOHIDEventTypeTemperature, 0, 0);
        if (!event) continue;

        double value = IOHIDEventGetFloatValue(event, kIOHIDEventTypeTemperature << 16);
        CFRelease(event);

        CFTypeRef product = IOHIDServiceClientCopyProperty(service, CFSTR("Product"));
        CSMCTemperature *entry = &out[count];
        memset(entry->name, 0, sizeof(entry->name));
        if (product && CFGetTypeID(product) == CFStringGetTypeID()) {
            CFStringGetCString((CFStringRef)product, entry->name, sizeof(entry->name), kCFStringEncodingUTF8);
        }
        if (product) CFRelease(product);
        entry->celsius = value;
        count++;
    }
    CFRelease(services);
    return count;
}
